'use client'

import { useState } from 'react'
import MainLayout from '@/components/layout/MainLayout'
import CommunicationSidebar from '@/components/communication/CommunicationSidebar'

export default function CommunicationLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  return (
    <MainLayout>
      <CommunicationSidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      <div
        className="transition-[margin-left] duration-200 ease-in-out"
        style={{ marginLeft: collapsed ? 64 : 240 }}
      >
        {children}
      </div>
    </MainLayout>
  )
}
