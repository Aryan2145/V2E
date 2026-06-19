'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import MainLayout from '@/components/layout/MainLayout'
import SettingsSidebar from '@/components/layout/SettingsSidebar'
import { useAuth } from '@/lib/auth/context'

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { user } = useAuth()
  const [collapsed, setCollapsed] = useState(false)

  // Organization Setup (people & structure) and System Configuration (access rights,
  // audit) are both platform-administration in the four-layer model → gated by is_admin.
  const showOrganization = !!user?.is_admin
  const showSystem = !!user?.is_admin

  // Bounce users who can see neither module out of Settings.
  useEffect(() => {
    if (!user) return
    if (!showOrganization && !showSystem) router.replace('/dashboard')
  }, [user, showOrganization, showSystem, router])

  return (
    <MainLayout>
      <div className="flex min-h-[calc(100vh-56px)]">
        <SettingsSidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed((c) => !c)}
          showOrganization={showOrganization}
          showSystem={showSystem}
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
