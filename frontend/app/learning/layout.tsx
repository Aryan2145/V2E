'use client'

import { useState } from 'react'
import MainLayout from '@/components/layout/MainLayout'
import LearningAdminSidebar from '@/components/learning/LearningAdminSidebar'

export default function LearningLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <MainLayout>
      <LearningAdminSidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <div
        className="transition-[margin-left] duration-200 ease-in-out"
        style={{ marginLeft: collapsed ? 64 : 240 }}
      >
        {children}
      </div>
    </MainLayout>
  )
}
