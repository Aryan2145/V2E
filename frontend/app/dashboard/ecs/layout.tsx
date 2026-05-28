'use client'

import { useState } from 'react'
import MainLayout from '@/components/layout/MainLayout'
import ECSSidebar from '@/components/layout/ECSSidebar'

export default function ECSLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <MainLayout>
      <div className="flex min-h-[calc(100vh-56px)]">
        <ECSSidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed((c) => !c)}
        />
        <main
          className="flex-1 min-h-full transition-[margin] duration-200 ease-in-out"
          style={{ marginLeft: collapsed ? 64 : 240 }}
        >
          <div className="px-8 py-8">{children}</div>
        </main>
      </div>
    </MainLayout>
  )
}
